"""Removes the exporter's debug text, which holds local file paths, from ONNX files.

Usage: python strip_onnx.py <file.onnx> [...]
"""
import sys

import onnx


def strip_graph(graph):
    graph.doc_string = ''
    del graph.metadata_props[:]
    for info in [*graph.input, *graph.output, *graph.value_info]:
        info.doc_string = ''
        del info.metadata_props[:]
    for tensor in graph.initializer:
        tensor.doc_string = ''
        del tensor.metadata_props[:]
    strip_nodes(graph.node)


def strip_nodes(nodes):
    for node in nodes:
        node.doc_string = ''
        del node.metadata_props[:]
        for attribute in node.attribute:
            attribute.doc_string = ''
            if attribute.HasField('g'):
                strip_graph(attribute.g)
            for graph in attribute.graphs:
                strip_graph(graph)


def strip_model(model):
    model.doc_string = ''
    del model.metadata_props[:]
    strip_graph(model.graph)
    for function in model.functions:
        function.doc_string = ''
        del function.metadata_props[:]
        strip_nodes(function.node)
    return model


if __name__ == '__main__':
    for path in sys.argv[1:]:
        onnx.save(strip_model(onnx.load(path)), path)
