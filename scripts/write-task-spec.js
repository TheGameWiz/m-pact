#!/usr/bin/env node
"use strict";

const ACCEPTED_FLAGS = ["root"];
const REQUIRED_FLAGS = [];
const REQUIRED_ONE_OF = [];

process.stderr.write("ERROR: write-task-spec has been renamed to write-design-spec; legacy-format specification containers are readable but have no write path.\n");
process.exit(1);
