#!/bin/bash
set -e
docker exec wordpress-temp ls -la /var/www/html/wp-content/mu-plugins/
docker exec wordpress-temp php -d memory_limit=512M -r '
require "/var/www/html/wp-load.php";
$r = wp_mail("nobody@example.com", "blocked-test", "should not send");
echo $r ? "MAIL_BLOCKED_OK\n" : "MAIL_FALSE\n";
'
