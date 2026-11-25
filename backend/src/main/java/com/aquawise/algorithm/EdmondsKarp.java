package com.aquawise.algorithm;
import java.util.*;
/** Self-implemented Edmonds-Karp; O(V E^2) time, O(V^2) matrix space. */
public class EdmondsKarp {
 public record Result(long maxFlow, long[][] flows, boolean[] sourceSide) {}
 public static Result solve(long[][] capacity,int source,int sink) {
  int n=capacity.length; if(n<2||source<0||sink<0||source>=n||sink>=n||source==sink) throw new IllegalArgumentException("Invalid source/sink");
  for(long[] row:capacity){if(row==null||row.length!=n)throw new IllegalArgumentException("Capacity matrix must be square");for(long c:row)if(c<0)throw new IllegalArgumentException("Negative capacity");}
  long[][] residual=new long[n][n], flow=new long[n][n];for(int i=0;i<n;i++)residual[i]=capacity[i].clone();long total=0;
  while(true){int[] parent=new int[n];Arrays.fill(parent,-1);parent[source]=source;long[] bottleneck=new long[n];bottleneck[source]=Long.MAX_VALUE;Queue<Integer> q=new ArrayDeque<>();q.add(source);
   while(!q.isEmpty()&&parent[sink]==-1){int u=q.poll();for(int v=0;v<n;v++)if(parent[v]==-1&&residual[u][v]>0){parent[v]=u;bottleneck[v]=Math.min(bottleneck[u],residual[u][v]);q.add(v);}}
   if(parent[sink]==-1)break;long delta=bottleneck[sink];total=Math.addExact(total,delta);
   for(int v=sink;v!=source;v=parent[v]){int u=parent[v];residual[u][v]-=delta;residual[v][u]=Math.addExact(residual[v][u],delta);flow[u][v]+=delta;flow[v][u]-=delta;}
  }
  boolean[] side=new boolean[n];Queue<Integer> q=new ArrayDeque<>();q.add(source);side[source]=true;while(!q.isEmpty()){int u=q.poll();for(int v=0;v<n;v++)if(!side[v]&&residual[u][v]>0){side[v]=true;q.add(v);}}
  return new Result(total,flow,side);
 }
}
