FROM nginx:alpine
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/sitio.conf
COPY docker-entrypoint.d/40-config.sh /docker-entrypoint.d/40-config.sh
RUN chmod +x /docker-entrypoint.d/40-config.sh
COPY dist/ /usr/share/nginx/html/
EXPOSE 80
