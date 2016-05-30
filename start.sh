#!/bin/sh

# Removes the validator 
sed -i .bak "s/'http:\/\/online.swagger.io\/validator'/null/" node_modules/swagger-ui/dist/swagger-ui.js;
sed -i .bak "s/'https:\/\/online.swagger.io\/validator'/null/" node_modules/swagger-ui/dist/swagger-ui.js;

node app.js;
wait;
