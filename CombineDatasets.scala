import org.apache.spark.sql.SparkSession
import org.apache.spark.sql.functions._
import org.apache.spark.sql.types._

object CombineDatasets {
  def main(args: Array[String]): Unit = {

    val spark = SparkSession.builder()
      .appName("CombineDatasets")
      .master("local[*]")
      .config("spark.sql.adaptive.enabled", "true")
      .config("spark.sql.adaptive.coalescePartitions.enabled", "true")
      .config("fs.defaultFS", "hdfs://localhost:9000")
      .getOrCreate()

    import spark.implicits._

    // Input paths - using HDFS files
    val prescriptionsPath = "hdfs://localhost:9000/input/prescriptions_multi.csv"
    val interactionsPath = "hdfs://localhost:9000/input/db_drug_interactions.csv"

    println("Loading datasets...")
    
    // Load prescriptions dataset
    val prescriptions = spark.read
      .option("header", "true")
      .option("inferSchema", "true")
      .csv(prescriptionsPath)
    
    println(s"Loaded ${prescriptions.count()} prescription records")

    // Load drug interactions dataset
    val interactions = spark.read
      .option("header", "true")
      .option("inferSchema", "true")
      .csv(interactionsPath)
      .withColumnRenamed("Drug 1", "drug1")
      .withColumnRenamed("Drug 2", "drug2")
      .withColumnRenamed("Interaction Description", "interaction_description")
    
    println(s"Loaded ${interactions.count()} drug interaction records")

    // Define maximum number of drugs per prescription
    val maxDrugs = 10

    // Process prescriptions: split drugs and create combinations labeled as "safe"
    println("Processing prescriptions dataset...")
    
    val prescriptionsProcessed = prescriptions
      .filter($"drug".isNotNull && trim($"drug") =!= "")
      .withColumn("drug_array", split(trim($"drug"), ","))
      .withColumn("drug_count", size($"drug_array"))
      .filter($"drug_count" >= 2) // Only keep prescriptions with 2 or more drugs
      
    // Create drug columns
    val drugCols = (0 until maxDrugs).map(i => 
      when($"drug_count" > i, trim($"drug_array".getItem(i)))
        .otherwise(null)
        .as(s"drug${i + 1}")
    )
    
    val prescriptionsExpanded = prescriptionsProcessed
    .select(
      ($"subject_id" +: $"doses_per_24_hrs" +: (drugCols :+ lit("safe").as("safety_label"))): _*
    )
    .filter($"drug1".isNotNull && $"drug2".isNotNull)

    
    println(s"Created ${prescriptionsExpanded.count()} prescription combinations")

    // Process interactions: label as "unsafe"
    println("Processing drug interactions dataset...")
    
    val interactionCols = Seq(
      lit(null).cast(IntegerType).as("subject_id"),
      lit(null).cast(DoubleType).as("doses_per_24_hrs"),
      trim($"drug1").as("drug1"),
      trim($"drug2").as("drug2")
    ) ++ (3 to maxDrugs).map(i => lit(null).cast(StringType).as(s"drug$i")) :+ 
    lit("unsafe").as("safety_label")

    val interactionsExpanded = interactions
    .filter($"drug1".isNotNull && $"drug2".isNotNull)
    .filter(trim($"drug1") =!= "" && trim($"drug2") =!= "")
    .select(interactionCols: _*)

    
    println(s"Created ${interactionsExpanded.count()} unsafe drug combinations")

    // Combine both datasets
    println("Combining datasets...")
    val combinedDataset = prescriptionsExpanded.unionByName(interactionsExpanded)
    
    // Add additional features
    val finalDataset = combinedDataset
      .withColumn("total_drugs", 
        (1 to maxDrugs).map(i => when(col(s"drug$i").isNotNull, 1).otherwise(0))
          .reduce(_ + _)
      )
      .withColumn("has_dosage_info", when($"doses_per_24_hrs".isNotNull, 1).otherwise(0))
      .withColumn("drug_combination_id", 
        concat_ws("_", (1 to maxDrugs).map(i => col(s"drug$i")): _*)
      )
      .filter($"total_drugs" >= 2) // Ensure we have at least 2 drugs
    
    println("Dataset combination complete!")
    
    // Show statistics for the complete dataset
    println("\n=== Complete Dataset Statistics ===")
    finalDataset.groupBy("safety_label").count().show()
    
    println("\n=== Drug Count Distribution ===")
    finalDataset.groupBy("total_drugs").count().orderBy("total_drugs").show()
    
    println("\n=== Sample Records ===")
    finalDataset.select("drug1", "drug2", "drug3", "safety_label", "total_drugs")
      .show(10, truncate = false)
    
    // Save the complete processed dataset
    val outputPath = "hdfs://localhost:9000/output/combined_dataset"
    println(s"\nSaving complete dataset to: $outputPath")
    
    finalDataset.coalesce(1)
      .write
      .mode("overwrite")
      .option("header", "true")
      .csv(outputPath)
    
    // Also save as a single CSV file for easier consumption
    val singleFilePath = "hdfs://localhost:9000/output/combined_dataset_complete.csv"
    finalDataset.coalesce(1)
      .write
      .mode("overwrite")
      .option("header", "true")
      .csv(singleFilePath)
    
    println("Complete dataset preprocessing finished successfully!")
    
    // Show final statistics for the complete dataset
    val totalRecords = finalDataset.count()
    val safeCount = finalDataset.filter($"safety_label" === "safe").count()
    val unsafeCount = finalDataset.filter($"safety_label" === "unsafe").count()
    
    println(s"\n=== Final Complete Dataset Summary ===")
    println(s"Total records: $totalRecords")
    println(s"Safe combinations: $safeCount")
    println(s"Unsafe combinations: $unsafeCount")
    println(s"Safety ratio: ${safeCount.toDouble / totalRecords * 100}% safe, ${unsafeCount.toDouble / totalRecords * 100}% unsafe")

    spark.stop()
  }
}
