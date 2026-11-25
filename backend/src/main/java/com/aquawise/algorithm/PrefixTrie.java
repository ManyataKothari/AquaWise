package com.aquawise.algorithm;
import java.util.*;
/** Self-implemented case-insensitive prefix index. */
public class PrefixTrie {
 private static class Node {Map<Character,Node> children=new TreeMap<>();TreeSet<String> values=new TreeSet<>();}
 private final Node root=new Node();
 public void insert(String value){if(value==null||value.isBlank())return;String normalized=value.strip().toLowerCase(Locale.ROOT);Node node=root;node.values.add(value);for(char ch:normalized.toCharArray()){node=node.children.computeIfAbsent(ch,k->new Node());node.values.add(value);}}
 public List<String> search(String prefix,int limit){if(prefix==null||limit<1)return List.of();Node node=root;for(char ch:prefix.strip().toLowerCase(Locale.ROOT).toCharArray()){node=node.children.get(ch);if(node==null)return List.of();}return node.values.stream().limit(limit).toList();}
}
