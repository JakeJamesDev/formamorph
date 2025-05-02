#!/usr/bin/env python3
"""
World Format Analyzer for Exotic Dangerous

This script analyzes a world JSON file and prints out the structure,
keys, and types of the data to help document the world format.

Usage:
    python world_format_analyzer.py <path_to_world_file.json>

Example:
    python world_format_analyzer.py defaultworlds/slime.json
"""

import json
import sys
import os
from typing import Any, Dict, List, Union


def analyze_value(value: Any, indent: int = 0) -> str:
    """Analyze a value and return its type information."""
    indent_str = "  " * indent
    
    if value is None:
        return f"{indent_str}Type: None"
    
    if isinstance(value, dict):
        result = f"{indent_str}Type: Object\n"
        result += analyze_dict(value, indent + 1)
        return result
    
    if isinstance(value, list):
        if not value:
            return f"{indent_str}Type: Empty Array"
        
        # Check if all items are of the same type
        first_type = type(value[0])
        all_same_type = all(isinstance(item, first_type) for item in value)
        
        if all_same_type and isinstance(value[0], dict):
            # For arrays of objects, analyze the first item as a sample
            result = f"{indent_str}Type: Array of Objects (length: {len(value)})\n"
            result += f"{indent_str}Sample item structure:\n"
            result += analyze_dict(value[0], indent + 1)
            return result
        elif all_same_type:
            return f"{indent_str}Type: Array of {first_type.__name__} (length: {len(value)})"
        else:
            return f"{indent_str}Type: Array of mixed types (length: {len(value)})"
    
    return f"{indent_str}Type: {type(value).__name__}, Value: {repr(value)[:100]}"


def analyze_dict(data: Dict[str, Any], indent: int = 0) -> str:
    """Recursively analyze a dictionary and return its structure."""
    result = ""
    indent_str = "  " * indent
    
    for key, value in data.items():
        result += f"{indent_str}Key: {key}\n"
        result += analyze_value(value, indent + 1) + "\n"
    
    return result


def analyze_world_file(file_path: str) -> None:
    """Analyze a world file and print its structure."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"=== World Format Analysis for {os.path.basename(file_path)} ===\n")
        print(analyze_dict(data))
        
        # Print a summary of top-level keys
        print("\n=== Top-Level Structure Summary ===")
        for key, value in data.items():
            if isinstance(value, dict):
                print(f"- {key}: Object with {len(value)} properties")
            elif isinstance(value, list):
                print(f"- {key}: Array with {len(value)} items")
            else:
                print(f"- {key}: {type(value).__name__}")
                
    except FileNotFoundError:
        print(f"Error: File '{file_path}' not found.")
    except json.JSONDecodeError:
        print(f"Error: '{file_path}' is not a valid JSON file.")
    except Exception as e:
        print(f"Error: {str(e)}")


def main():
    """Main function to handle command line arguments."""
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <path_to_world_file.json>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    analyze_world_file(file_path)


if __name__ == "__main__":
    main()
