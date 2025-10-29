#requires -Version 7

$body = '{"usuario":"admin","senha":"Senha@123"}'
Invoke-WebRequest -Method Post -Uri http://localhost:5000/api/auth/login -ContentType 'application/json' -Body $body | Select-Object -ExpandProperty Content
