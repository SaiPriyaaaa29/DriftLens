# DriftLens Architecture

## Overview

DriftLens analyzes software repositories and detects contradictions between configuration sources.

## Architecture Flow

```text
Repository
    |
    v
Repository Scanner
    |
    v
File Parsers
    |
    v
Extracted Facts
    |
    v
Detection Rules
    |
    v
Severity Classifier
    |
    v
Analysis Result
    |
    +------------------+
    |                  |
    v                  v
React Dashboard    AI Repair Plan
