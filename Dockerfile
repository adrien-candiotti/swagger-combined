FROM mhart/alpine-node

WORKDIR /build
COPY ./package.json /build/package.json

RUN npm install

ADD . /build

# run app
CMD ["sh", "start.sh"]
