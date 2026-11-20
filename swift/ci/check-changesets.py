#!/usr/bin/env python3
import sys
from metadata import validate_pull_request

try:
    validate_pull_request(sys.argv[1], sys.argv[2] == "true")
except ValueError as error:
    sys.exit(f"::error::{error}")
