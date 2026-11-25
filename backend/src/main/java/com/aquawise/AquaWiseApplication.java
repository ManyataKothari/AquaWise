package com.aquawise.v2;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@SpringBootApplication
@RestController
@RequestMapping("/api/v2")
@CrossOrigin(origins = {
    "http://localhost:5173",
    "http://127.0.0.1:5173"
})
public class AquaWiseApplication {

    public static void main(String[] args) {
        SpringApplication.run(AquaWiseApplication.class, args);
    }

    record District(
        String id, String name, String state,
        double lat, double lon, int supply, int demand
    ) {}

    record Project(
        String id, String name, int cost, int saving
    ) {}

    record Request(
        String districtId,
        int rainfallReduction,
        int capacityPercent,
        int demandPercent,
        int budget,
        boolean extraSource
    ) {}

    static final List<District> DISTRICTS = List.of(
        new District("pune", "Pune", "Maharashtra",
            18.52, 73.86, 720, 980),
        new District("nashik", "Nashik", "Maharashtra",
            19.99, 73.79, 590, 800),
        new District("nagpur", "Nagpur", "Maharashtra",
            21.15, 79.09, 530, 720),
        new District("mumbai", "Mumbai City", "Maharashtra",
            18.96, 72.82, 1050, 1200),
        new District("jaipur", "Jaipur", "Rajasthan",
            26.91, 75.79, 460, 850),
        new District("bengaluru", "Bengaluru Urban", "Karnataka",
            12.97, 77.59, 760, 1100),
        new District("hyderabad", "Hyderabad", "Telangana",
            17.39, 78.49, 680, 990),
        new District("delhi", "New Delhi", "Delhi",
            28.61, 77.21, 840, 1120),
        new District("varanasi", "Varanasi", "Uttar Pradesh",
            25.32, 83.01, 460, 650),
        new District("chennai", "Chennai", "Tamil Nadu",
            13.08, 80.27, 650, 930)
    );

    static final List<Project> PROJECTS = List.of(
        new Project("leaks",
            "Repair distribution leaks", 20, 110),
        new Project("harvest",
            "Rooftop rainwater harvesting", 12, 55),
        new Project("reuse",
            "Treated wastewater reuse", 35, 170),
        new Project("irrigation",
            "Efficient irrigation systems", 25, 130),
        new Project("recharge",
            "Groundwater recharge projects", 18, 75)
    );

    static District district(String id) {
        return DISTRICTS.stream()
            .filter(d -> d.id().equals(id))
            .findFirst()
            .orElseThrow(() ->
                new IllegalArgumentException("Unknown district")
            );
    }

    static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of(
            "status", "ok",
            "version", "3.0"
        );
    }

    @GetMapping("/districts")
    public List<District> districts() {
        return DISTRICTS;
    }

    @GetMapping("/projects")
    public List<Project> projects() {
        return PROJECTS;
    }

    // ==========================================
    // ALGORITHM 1: TRIE
    // ==========================================

    static class TrieNode {
        Map<Character, TrieNode> children = new TreeMap<>();
        List<String> values = new ArrayList<>();
    }

    static final TrieNode ROOT = new TrieNode();

    static {
        for (District d : DISTRICTS) {
            TrieNode node = ROOT;

            for (char c :
                d.name().toLowerCase(Locale.ROOT).toCharArray()) {

                node = node.children.computeIfAbsent(
                    c, k -> new TrieNode()
                );

                node.values.add(d.name());
            }
        }
    }

    @GetMapping("/search")
    public List<String> search(
        @RequestParam(defaultValue = "") String q
    ) {
        if (q.isBlank()) return List.of();

        TrieNode node = ROOT;

        for (char c :
            q.trim().toLowerCase(Locale.ROOT).toCharArray()) {

            node = node.children.get(c);

            if (node == null) return List.of();
        }

        return node.values.stream()
            .distinct()
            .limit(8)
            .toList();
    }

    @GetMapping("/trie-trace")
    public Map<String, Object> trieTrace(
        @RequestParam(defaultValue = "pu") String q
    ) {
        TrieNode node = ROOT;
        List<Map<String, Object>> steps = new ArrayList<>();
        String prefix = "";

        for (char c :
            q.trim().toLowerCase(Locale.ROOT).toCharArray()) {

            prefix += c;
            node = node.children.get(c);

            steps.add(Map.of(
                "character", String.valueOf(c),
                "prefix", prefix,
                "found", node != null
            ));

            if (node == null) break;
        }

        return Map.of(
            "steps", steps,
            "matches", search(q)
        );
    }

    // ==========================================
    // ALGORITHM 2: BLOOM FILTER
    // ==========================================

    static final BitSet BITS = new BitSet(4096);
    static final Set<String> REPORTS = new HashSet<>();
    static final int[] SEEDS = {17, 31, 53};

    static int hash(String s, int seed) {
        int h = seed;

        for (char c : s.toCharArray()) {
            h = 31 * h + c;
        }

        return Math.floorMod(h, 4096);
    }

    static {
        for (District d : DISTRICTS) {
            String id =
                "WQ-" + d.id().toUpperCase(Locale.ROOT);

            REPORTS.add(id);

            for (int seed : SEEDS) {
                BITS.set(hash(id, seed));
            }
        }
    }

    @GetMapping("/verify")
    public Map<String, Object> verify(
        @RequestParam String id
    ) {
        String key = id.trim().toUpperCase(Locale.ROOT);

        boolean maybe = true;

        List<Map<String, Object>> positions =
            new ArrayList<>();

        for (int seed : SEEDS) {
            int position = hash(key, seed);
            boolean set = BITS.get(position);

            maybe &= set;

            positions.add(Map.of(
                "seed", seed,
                "position", position,
                "bit", set ? 1 : 0
            ));
        }

        return Map.of(
            "id", key,
            "bloomPossiblyPresent", maybe,
            "exactFound", REPORTS.contains(key),
            "positions", positions
        );
    }

    // ==========================================
    // ALGORITHM 3: EDMONDS-KARP
    // ==========================================

    static int[][] solveFlow(
        int[][] capacities,
        int source,
        int sink
    ) {
        return solveFlow(
            capacities, source, sink, new ArrayList<>()
        );
    }

    static int[][] solveFlow(
        int[][] capacities,
        int source,
        int sink,
        List<Map<String, Object>> trace
    ) {
        int n = capacities.length;
        int[][] residual = new int[n][n];

        for (int i = 0; i < n; i++) {
            residual[i] = capacities[i].clone();
        }

        int total = 0;

        while (true) {
            int[] parent = new int[n];

            Arrays.fill(parent, -1);
            parent[source] = source;

            Queue<Integer> queue = new ArrayDeque<>();
            queue.add(source);

            while (!queue.isEmpty() && parent[sink] < 0) {
                int u = queue.remove();

                for (int v = 0; v < n; v++) {
                    if (parent[v] < 0 && residual[u][v] > 0) {
                        parent[v] = u;
                        queue.add(v);
                    }
                }
            }

            if (parent[sink] < 0) break;

            int add = Integer.MAX_VALUE;

            List<Integer> path = new ArrayList<>();
            path.add(sink);

            for (int v = sink; v != source; v = parent[v]) {
                add = Math.min(
                    add, residual[parent[v]][v]
                );

                path.add(parent[v]);
            }

            Collections.reverse(path);

            for (int v = sink; v != source; v = parent[v]) {
                residual[parent[v]][v] -= add;
                residual[v][parent[v]] += add;
            }

            total += add;

            trace.add(Map.of(
                "path", path,
                "added", add,
                "total", total
            ));
        }

        int[][] flow = new int[n][n];

        for (int i = 0; i < n; i++) {
            for (int j = 0; j < n; j++) {
                flow[i][j] = Math.max(
                    0, capacities[i][j] - residual[i][j]
                );
            }
        }

        return flow;
    }

    static int maxFlow(
        int[][] capacities,
        int source,
        int sink
    ) {
        return Arrays.stream(
            solveFlow(capacities, source, sink)[source]
        ).sum();
    }

    // ==========================================
    // ALGORITHM 4: 0/1 KNAPSACK
    // ==========================================

    static Map<String, Object> plan(int budget) {
        budget = clamp(budget, 0, 150);

        int n = PROJECTS.size();

        int[][] dp = new int[n + 1][budget + 1];

        for (int i = 1; i <= n; i++) {
            Project p = PROJECTS.get(i - 1);

            for (int b = 0; b <= budget; b++) {
                dp[i][b] = dp[i - 1][b];

                if (b >= p.cost()) {
                    dp[i][b] = Math.max(
                        dp[i][b],
                        dp[i - 1][b - p.cost()] + p.saving()
                    );
                }
            }
        }

        List<Project> chosen = new ArrayList<>();

        int b = budget;

        for (int i = n; i >= 1; i--) {
            if (dp[i][b] != dp[i - 1][b]) {
                Project p = PROJECTS.get(i - 1);

                chosen.add(p);
                b -= p.cost();
            }
        }

        Collections.reverse(chosen);

        return Map.of(
            "projects", chosen,
            "savings", dp[n][budget],
            "cost", budget - b,
            "table", dp
        );
    }

    @GetMapping("/knapsack")
    public Map<String, Object> knapsack(
        @RequestParam(defaultValue = "50") int budget
    ) {
        return plan(budget);
    }

    // ==========================================
    // WATER SIMULATION
    // ==========================================

    @PostMapping("/simulate")
    public Map<String, Object> simulate(
        @RequestBody Request r
    ) {
        return calculate(r, 0);
    }

    static Map<String, Object> calculate(
        Request r,
        int sourceRestriction
    ) {
        District d = district(
            r.districtId() == null ? "pune" : r.districtId()
        );

        int rain = clamp(r.rainfallReduction(), 0, 60);
        int capacity = clamp(r.capacityPercent(), 10, 100);
        int demandPercent = clamp(r.demandPercent(), 50, 150);
        int budget = clamp(r.budget(), 0, 150);

        sourceRestriction = clamp(sourceRestriction, 0, 100);

        int climateSupply = (int) Math.round(
            d.supply() * (1 - 0.7 * rain / 100.0)
        );

        int available = (int) Math.round(
            climateSupply * (1 - sourceRestriction / 100.0)
        );

        int demand = (int) Math.round(
            d.demand() * demandPercent / 100.0
        );

        int household = demand * 42 / 100;
        int agriculture = demand * 34 / 100;
        int industry = demand - household - agriculture;

        int[] needs = {
            household, agriculture, industry
        };

        int extra = r.extraSource()
            ? (int) Math.round(d.supply() * 0.20)
            : 0;

        int[][] c = new int[8][8];

        c[0][1] = available;
        c[1][3] = available;

        c[0][2] = extra;
        c[2][3] = extra;

        for (int i = 0; i < 3; i++) {
            c[3][4 + i] = (int) Math.round(
                needs[i] * capacity / 100.0
            );

            c[4 + i][7] = needs[i];
        }

        List<Map<String, Object>> trace = new ArrayList<>();

        int[][] flow = solveFlow(c, 0, 7, trace);

        int delivered = Arrays.stream(flow[0]).sum();
        int unmet = Math.max(0, demand - delivered);

        String[] names = {
            "Households", "Agriculture", "Industry"
        };

        Map<String, Object> allocation =
            new LinkedHashMap<>();

        for (int i = 0; i < 3; i++) {
            allocation.put(
                names[i],
                Map.of(
                    "demand", needs[i],
                    "delivered", flow[4 + i][7],
                    "pipeCapacity", c[3][4 + i]
                )
            );
        }

        Map<String, Object> recommendation = plan(budget);

        int savings = (int) recommendation.get("savings");

        List<Map<String, Object>> forecast =
            new ArrayList<>();

        for (int days : new int[]{30, 60, 90}) {
            int futureSupply = (int) Math.round(
                available * Math.max(
                    0.45,
                    1 - (days / 30.0) * rain / 500.0
                )
            );

            int futureDelivery = Math.min(
                demand,
                Math.min(
                    futureSupply + extra,
                    Arrays.stream(c[3]).sum()
                )
            );

            forecast.add(Map.of(
                "days", days,
                "estimatedDelivered", futureDelivery,
                "estimatedShortage",
                Math.max(0, demand - futureDelivery)
            ));
        }

        List<String> problems = new ArrayList<>();
        List<String> solutions = new ArrayList<>();

        if (rain >= 20) {
            problems.add("Reduced rainfall and water availability");
            solutions.add("Improve storage and groundwater recharge");
        }

        if (capacity < 80) {
            problems.add("Restricted pipeline capacity");
            solutions.add("Inspect pipelines and repair leakage");
        }

        if (unmet > demand * 0.30) {
            problems.add("High modeled water shortage");
            solutions.add("Prepare supplementary water sources");
        }

        if (demandPercent > 110) {
            problems.add("Increasing water demand");
            solutions.add("Promote efficient irrigation and water reuse");
        }

        if (sourceRestriction > 0) {
            problems.add("Local water source partially restricted");
            solutions.add("Investigate contamination and treatment options");
        }

        if (problems.isEmpty()) {
            problems.add("No additional severe scenario trigger");
            solutions.add("Continue monitoring and conservation");
        }

        return Map.ofEntries(
            Map.entry("district", d),
            Map.entry("available", available),
            Map.entry("extraSupply", extra),
            Map.entry("demand", demand),
            Map.entry("delivered", delivered),
            Map.entry("unmet", unmet),
            Map.entry("coverage",
                Math.round(delivered * 100.0 / demand)),
            Map.entry("allocation", allocation),
            Map.entry("plan", recommendation),
            Map.entry("afterPlanShortage",
                Math.max(0, unmet - savings)),
            Map.entry("forecast", forecast),
            Map.entry("problems", problems),
            Map.entry("solutions", solutions),
            Map.entry("flowTrace", trace),
            Map.entry("flowMatrix", flow),
            Map.entry("capacityMatrix", c),
            Map.entry("sourceRestriction", sourceRestriction),
            Map.entry("assumptions",
                "Synthetic scenario model, not live measurements")
        );
    }
}