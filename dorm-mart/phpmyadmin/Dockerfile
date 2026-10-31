# phpMyAdmin for the Railway project. Deploy it WITHOUT a public domain and reach
# it over Railway private networking only; it is a login page to the database.
FROM phpmyadmin/phpmyadmin:latest

# Connection details come from Railway service variables (PMA_HOST, PMA_PORT,
# PMA_USER, PMA_PASSWORD). Nothing is defaulted here so a misconfigured deploy
# cannot fall back to root with an empty password.

# Only the configured server. Arbitrary-host mode turns the page into an open
# MySQL proxy for anyone who can reach it.
ENV PMA_ARBITRARY=0
