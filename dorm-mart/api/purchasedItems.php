<?php
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
  ["id"=>1,"title"=>"Wireless Mouse","seller"=>"Chris Kim","date"=>"2024-01-10"],
  ["id"=>2,"title"=>"Wireless Mouse","seller"=>"Chris Kim","date"=>"2024-01-11"]
]);