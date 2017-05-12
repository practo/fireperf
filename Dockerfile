FROM ubuntu:16.04
MAINTAINER Deven Vyas <vyas.deven@gmail.com>

ENV DEBIAN_FRONTEND=noninteractive

RUN set -xe

RUN apt-get update

RUN apt-get install -y --no-install-recommends \
    software-properties-common ca-certificates curl \
    sudo supervisor socat \
    xvfb xvfb x11vnc fluxbox xterm

RUN curl -fsSL https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends google-chrome-stable

RUN curl -sL https://deb.nodesource.com/setup_6.x | bash - && \
    apt-get install -y nodejs

RUN apt-get install -y vim

RUN rm -rf /var/lib/apt/lists/*

RUN set -xe \
    && useradd -u 1000 -g 100 -G sudo --shell /bin/bash --no-create-home --home-dir /tmp user \
    && echo 'ALL ALL = (ALL:ALL) NOPASSWD: ALL' >> /etc/sudoers

COPY supervisord.conf /etc/
COPY entry.sh /

COPY app/ /app

WORKDIR /app

RUN npm install

RUN chmod +x /entry.sh

User user
WORKDIR /tmp
VOLUME /tmp/chrome-data


CMD ["/entry.sh"]
