#!/bin/bash
unset CI
export DISABLE_ESLINT_PLUGIN=true
export CI=false
react-scripts build
