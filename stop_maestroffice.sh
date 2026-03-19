#!/bin/bash

pskillall() {
    pids=$(ps aux | grep "$1" | grep -v run.sh | grep -v grep | grep -v pskillall | awk '{print $2}')

    cnt=$(echo "$pids" | grep -v '^$' | wc -l)

    if [ "${cnt}" -eq 0 ]; then
        # echo "process num is 0, no need to kill"
        exit
    else
        echo "$pids" | xargs kill -9
    fi
}

./stop_prod.sh
pskillall ai_company_trigger.py
pskillall run_single_role.py