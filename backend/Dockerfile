FROM php:8.4.27-apache

# Check the actual runtime before installing dependencies or serving requests.
COPY docker/check-runtime.php /usr/local/bin/alrm-check-runtime.php
RUN php /usr/local/bin/alrm-check-runtime.php

COPY docker/php-security.ini /usr/local/etc/php/conf.d/zz-alrm-security.ini

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    git \
    curl \
    libpng-dev \
    libjpeg62-turbo-dev \
    libonig-dev \
    libxml2-dev \
    libzip-dev \
    zip \
    unzip \
    supervisor \
    qpdf \
    && rm -rf /var/lib/apt/lists/*

RUN qpdf --version

# Install PHP extensions with GD JPEG support
RUN docker-php-ext-configure gd --with-jpeg \
    && docker-php-ext-install pdo pdo_mysql mbstring exif pcntl bcmath gd zip

# Verify JPEG and PNG support after installation
RUN php -r 'if (!gd_info()["JPEG Support"] || !gd_info()["PNG Support"]) { fwrite(STDERR, "GD JPEG/PNG support is required.\n"); exit(1); }'

# Enable Apache mod_rewrite
RUN a2enmod rewrite

# Point Apache's document root to Laravel's public folder
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf
RUN sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

# Copy after path rewrites so the explicit public directory is preserved.
COPY docker/apache-security.conf /etc/apache2/conf-available/alrm-security.conf
RUN a2enconf alrm-security && apache2ctl -t

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Copy Composer files first for dependency caching
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --optimize-autoloader

# Copy application files
COPY . .

# Generate the optimized autoloader
RUN composer dump-autoload --optimize

# Run the web server and Laravel queue worker under one process manager.
COPY docker/supervisord.conf /etc/supervisor/conf.d/alrm.conf
RUN sed -i 's/\r$//' docker/start.sh \
    && chmod +x docker/start.sh

# Set Laravel directory permissions
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache \
    && chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

EXPOSE 10000

CMD ["/bin/bash", "/var/www/html/docker/start.sh"]
