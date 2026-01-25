#!/bin/bash
npm install
cp $CONDUCTOR_ROOT_PATH/.env .env
cp $CONDUCTOR_ROOT_PATH/services/ge-sync/.env services/ge-sync/.env
