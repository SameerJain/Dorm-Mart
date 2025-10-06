
CREATE TABLE IF NOT EXISTS transacted_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,   
  title VARCHAR(200) NOT NULL,                 
  sold_by VARCHAR(100) NOT NULL,                
  transacted_at DATETIME NOT NULL,               
  KEY idx_title (title),                    
  KEY idx_transacted_at (transacted_at)           
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;