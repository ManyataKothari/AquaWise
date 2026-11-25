package com.aquawise.v2;

import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/v2")
@CrossOrigin(origins = {
    "http://localhost:5173",
    "http://127.0.0.1:5173"
})
public class InteractiveController {

    record Mission(
        String id,
        String title,
        String districtId,
        int rainfall,
        int capacity,
        int demand,
        int budget,
        int restriction,
        String description
    ) {}

    record MissionRequest(
        String missionId,
        List<String> projectIds
    ) {}

    record PollutionRequest(
        String districtId,
        int rainfallReduction,
        int restriction
    ) {}

    static final List<Mission> MISSIONS = List.of(

        new Mission(
            "pune", "Save Pune",
            "pune", 40, 100, 100, 50, 0,
            "Manage a severe rainfall deficit."
        ),

        new Mission(
            "chennai", "Rescue Chennai",
            "chennai", 30, 90, 120, 60, 0,
            "Manage increasing urban water demand."
        ),

        new Mission(
            "rajasthan", "Protect Rajasthan",
            "jaipur", 50, 100, 100, 70, 0,
            "Respond to prolonged drought."
        ),

        new Mission(
            "farms", "Save Maharashtra's Farms",
            "nashik", 35, 90, 120, 55, 0,
            "Reduce agricultural water shortages."
        ),

        new Mission(
            "river", "Protect the River",
            "varanasi", 10, 100, 100, 65, 30,
            "Respond to a restricted freshwater source."
        ),

        new Mission(
            "ultimate", "The Ultimate Water Crisis",
            "bengaluru", 50, 65, 130, 100, 25,
            "Manage drought, pollution and pipeline failures."
        )
    );

    @GetMapping("/missions")
    public List<Mission> missions() {
        return MISSIONS;
    }

    @PostMapping("/mission")
    public Map<String, Object> mission(
        @RequestBody MissionRequest request
    ) {

        Mission m = MISSIONS.stream()
            .filter(x -> x.id().equals(request.missionId()))
            .findFirst()
            .orElseThrow(() ->
                new IllegalArgumentException("Unknown mission")
            );

        Set<String> ids = new HashSet<>(
            request.projectIds() == null
                ? List.of()
                : request.projectIds()
        );

        int cost = 0;
        int savings = 0;

        List<AquaWiseApplication.Project> chosen =
            new ArrayList<>();

        for (AquaWiseApplication.Project p :
            AquaWiseApplication.PROJECTS) {

            if (ids.contains(p.id())) {
                cost += p.cost();
                savings += p.saving();
                chosen.add(p);
            }
        }

        AquaWiseApplication.Request scenario =
            new AquaWiseApplication.Request(
                m.districtId(),
                m.rainfall(),
                m.capacity(),
                m.demand(),
                m.budget(),
                false
            );

        Map<String, Object> result =
            AquaWiseApplication.calculate(
                scenario, m.restriction()
            );

        int shortage = (int) result.get("unmet");

        Map<String, Object> optimal =
            AquaWiseApplication.plan(m.budget());

        int best = (int) optimal.get("savings");

        boolean valid = cost <= m.budget();

        int score = valid && best > 0
            ? Math.min(100,
                (int) Math.round(savings * 100.0 / best))
            : 0;

        int stars = !valid || score == 0 ? 0
            : score == 100 ? 3
            : score >= 60 ? 2 : 1;

        return Map.ofEntries(
            Map.entry("mission", m),
            Map.entry("valid", valid),
            Map.entry("cost", cost),
            Map.entry("budget", m.budget()),
            Map.entry("savings", savings),
            Map.entry("shortage", shortage),
            Map.entry("remainingShortage",
                valid ? Math.max(0, shortage - savings)
                      : shortage),
            Map.entry("score", score),
            Map.entry("stars", stars),
            Map.entry("chosen", chosen),
            Map.entry("optimal", optimal)
        );
    }

    @PostMapping("/pollution")
    public Map<String, Object> pollution(
        @RequestBody PollutionRequest request
    ) {

        AquaWiseApplication.Request scenario =
            new AquaWiseApplication.Request(
                request.districtId(),
                request.rainfallReduction(),
                100,
                100,
                50,
                false
            );

        Map<String, Object> before =
            AquaWiseApplication.calculate(scenario, 0);

        Map<String, Object> after =
            AquaWiseApplication.calculate(
                scenario, request.restriction()
            );

        return Map.of(
            "before", before,
            "after", after,
            "lostDelivery",
                (int) before.get("delivered")
                - (int) after.get("delivered"),
            "note",
                "Hypothetical source restriction, not a water safety assessment"
        );
    }
}