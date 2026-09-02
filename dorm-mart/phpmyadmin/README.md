# Deploying phpMyAdmin on Railway

1. Create a service in the Railway project.
2. Connect the service to this directory, or deploy it from the included `Dockerfile`.
3. Configure the following environment variables:

   | Variable | Value |
   | --- | --- |
   | `PMA_HOST` | The internal hostname of the MySQL service, usually `mysql` or the Railway service name |
   | `PMA_PORT` | `3306` |
   | `PMA_USER` | The MySQL username |
   | `PMA_PASSWORD` | The MySQL password |
   | `PMA_ARBITRARY` | `1`, which permits connections to other MySQL servers |

4. Deploy the service. Railway should detect the `Dockerfile` automatically.
5. Open phpMyAdmin at the URL assigned by Railway.

Restrict access to the deployed phpMyAdmin service and avoid exposing database credentials in logs or source control.
