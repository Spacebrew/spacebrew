This has been tested with Firefox. Firefox seems to not connect to wss using an expired certificate, but a self-signed cert is fine.

to self-sign a cert, cd into this directory and run the following command (assuming you have openssl installed):

`openssl req -config localhost.conf -new -sha256 -newkey rsa:2048 -nodes -x509 -days 365 -out server-key.crt`
