package com.aquawise.model;
import java.util.List;
public record NetworkRequest(List<Node> nodes,List<Edge> edges) {
 public record Node(String id,String label,String type,long amount){}
 public record Edge(String from,String to,long capacity){}
}
