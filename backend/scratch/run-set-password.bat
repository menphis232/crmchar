@echo off
"C:\Program Files\PuTTY\pscp.exe" -pw 24@Camila@232 "backend\scratch\set-dealer-password.js" root@2.25.197.82:/tmp/set-dealer-password.js
"C:\Program Files\PuTTY\plink.exe" -ssh -l root -pw 24@Camila@232 2.25.197.82 -batch "docker cp /tmp/set-dealer-password.js tramites-backend:/app/set-dealer-password.js && docker exec tramites-backend node set-dealer-password.js"
