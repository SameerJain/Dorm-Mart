<?php
header('Content-Type: application/json');

// reuse your existing env loader + $conn creation
require __DIR__ . '/db_connect.php'; // or paste your env+mysqli code here

$conn = db();

// create a table that records which migration files have been applied
$conn->query("
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB");

// reads applied filenames and stores them in a hash map
$applied = [];
$res = $conn->query("SELECT filename FROM schema_migrations");
while ($row = $res->fetch_assoc()) $applied[$row['filename']] = true;

// collect migration files and order them
$dir = dirname(__DIR__) . '/migrations';
$files = glob($dir . '/*.sql');
natsort($files);

// apply pending migrations
$ran = [];
foreach ($files as $path) {
  $name = basename($path);
  // skip already applied to avoid re-running the same migration
  if (isset($applied[$name])) continue;
  // read sql file contents
  $sql = file_get_contents($path);
  // starts a db transaction to ensure atomicity
  $conn->begin_transaction();

  if (!$conn->multi_query($sql)) {
    $err = $conn->error;
    $conn->rollback();
    echo json_encode(["success"=>false, "message"=>"Failed: $name — $err"]);
    exit;
  }

  // flush multi_query results
  while ($conn->more_results() && $conn->next_result()) { /* flush */ }

  $stmt = $conn->prepare("INSERT INTO schema_migrations (filename) VALUES (?)");
  $stmt->bind_param("s", $name);
  $stmt->execute();

  // records the successful migration filenmae
  $conn->commit();
  $ran[] = $name;
}

echo json_encode(["success"=>true, "applied"=>$ran]);
