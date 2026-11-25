package com.aquawise.api;
import com.aquawise.algorithm.*;import com.aquawise.model.NetworkRequest;import org.springframework.http.*;import org.springframework.web.bind.annotation.*;import java.util.*;
@RestController @RequestMapping("/api") @CrossOrigin(origins="http://localhost:5173")
public class WaterController {
 private final List<Map<String,Object>> stations=List.of(
  Map.of("id","WQ-101","name","Lake Aster","region","North Basin","ph",7.2,"turbidity",2.1,"status","eligible","supply",520),
  Map.of("id","WQ-102","name","River Solis","region","East Valley","ph",6.3,"turbidity",9.4,"status","restricted","supply",380),
  Map.of("id","WQ-103","name","Cedar Reservoir","region","West Ridge","ph",7.5,"turbidity",1.8,"status","eligible","supply",340),
  Map.of("id","WQ-104","name","Willow Intake","region","South Basin","ph",7.0,"turbidity",3.3,"status","review","supply",220));
 private final PrefixTrie trie=new PrefixTrie();private final BloomFilter bloom=new BloomFilter(2048,4);private final Set<String> ids=new HashSet<>();
 public WaterController(){for(var s:stations){trie.insert((String)s.get("name"));String id=(String)s.get("id");ids.add(id);bloom.add(id);}}
 @GetMapping("/stations") public List<Map<String,Object>> stations(){return stations;}
 @GetMapping("/search") public Map<String,Object> search(@RequestParam(defaultValue="")String q){return Map.of("suggestions",trie.search(q,8));}
 @GetMapping("/reports/{id}/exists") public Map<String,Object> exists(@PathVariable String id){boolean possible=bloom.mightContain(id);return Map.of("possible",possible,"exists",possible&&ids.contains(id));}
 @PostMapping("/optimize") public Map<String,Object> optimize(@RequestBody NetworkRequest req){
  if(req==null||req.nodes()==null||req.edges()==null||req.nodes().size()<2||req.nodes().size()>80||req.edges().size()>1000)throw new IllegalArgumentException("Provide 2–80 nodes and at most 1000 edges");
  int n=req.nodes().size(),source=n,sink=n+1;Map<String,Integer> index=new HashMap<>();long[][] cap=new long[n+2][n+2];long demand=0,supply=0;
  for(int i=0;i<n;i++){var node=req.nodes().get(i);if(node==null||node.id()==null||node.id().isBlank()||node.amount()<0||!Set.of("source","community","junction").contains(node.type())||index.putIfAbsent(node.id(),i)!=null)throw new IllegalArgumentException("Invalid or duplicate node");}
  for(int i=0;i<n;i++){var node=req.nodes().get(i);if(node.type().equals("source")){cap[source][i]=node.amount();supply=Math.addExact(supply,node.amount());}if(node.type().equals("community")){cap[i][sink]=node.amount();demand=Math.addExact(demand,node.amount());}}
  for(var e:req.edges()){if(e==null||!index.containsKey(e.from())||!index.containsKey(e.to())||e.capacity()<0||e.from().equals(e.to()))throw new IllegalArgumentException("Invalid edge");int u=index.get(e.from()),v=index.get(e.to());cap[u][v]=Math.addExact(cap[u][v],e.capacity());}
  var result=EdmondsKarp.solve(cap,source,sink);List<Map<String,Object>> flows=new ArrayList<>(),communities=new ArrayList<>();for(var e:req.edges()){int u=index.get(e.from()),v=index.get(e.to());flows.add(Map.of("from",e.from(),"to",e.to(),"flow",Math.max(0,result.flows()[u][v]),"capacity",e.capacity()));}
  for(int i=0;i<n;i++){var node=req.nodes().get(i);if(node.type().equals("community"))communities.add(Map.of("id",node.id(),"name",node.label(),"delivered",Math.max(0,result.flows()[i][sink]),"demand",node.amount()));}
  return Map.of("maxFlow",result.maxFlow(),"totalSupply",supply,"totalDemand",demand,"unmetDemand",demand-result.maxFlow(),"flows",flows,"communities",communities,"method","Edmonds–Karp maximum flow","disclaimer","Synthetic planning model; not a drinking-water safety assessment");
 }
 @ExceptionHandler({IllegalArgumentException.class,ArithmeticException.class})public ResponseEntity<Map<String,String>> invalid(RuntimeException ex){return ResponseEntity.badRequest().body(Map.of("error",ex.getMessage()));}
}
