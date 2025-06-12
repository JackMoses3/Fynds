#!/bin/bash

while true; do
  echo "Starting backend..."
  (cd backend && npm run start:dev >> ../backend.log 2>&1) & 
  BACKEND_PID=$!

  echo "Waiting 20 seconds for backend to initialize..."
  sleep 20

  echo "Starting embed_all_retailers.py..."
  python embed_all_retailers.py & 
  PYTHON_PID=$!

  echo "Running for 2 hours..."
  sleep $((1 * 60 * 60))  # 2 hours

  echo "Stopping backend and Python script..."
  kill $BACKEND_PID
  kill $PYTHON_PID

  echo "Sleeping 5 seconds before restart..."
  sleep 5
done
