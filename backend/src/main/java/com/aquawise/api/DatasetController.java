
package com.aquawise.api;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/dataset")
@CrossOrigin(origins = "http://localhost:5173")
public class DatasetController {

    private volatile List<Map<String, Object>> records = List.of();

    @PostMapping(
        value = "/upload",
        consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<?> upload(
            @RequestParam("file") MultipartFile file) {

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(
                Map.of("error", "CSV file is empty")
            );
        }

        if (file.getSize() > 2_000_000) {
            return ResponseEntity.badRequest().body(
                Map.of("error", "Maximum file size is 2 MB")
            );
        }

        List<Map<String, Object>> parsed = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(
                    file.getInputStream(),
                    StandardCharsets.UTF_8))) {

            String header = reader.readLine();

            if (header == null ||
                !header.replace("\uFEFF", "").trim()
                    .equalsIgnoreCase(
                        "station,date,latitude,longitude,ph,do,bod")) {

                throw new IllegalArgumentException(
                    "Expected columns: " +
                    "station,date,latitude,longitude,ph,do,bod"
                );
            }

            String line;
            int rowNumber = 1;

            while ((line = reader.readLine()) != null) {
                rowNumber++;

                if (line.isBlank()) continue;

                String[] values = line.split(",", -1);

                if (values.length != 7) {
                    throw new IllegalArgumentException(
                        "Invalid number of columns at row " +
                        rowNumber
                    );
                }

                String station = values[0].trim();
                LocalDate date =
                    LocalDate.parse(values[1].trim());

                double latitude =
                    Double.parseDouble(values[2].trim());

                double longitude =
                    Double.parseDouble(values[3].trim());

                double ph =
                    Double.parseDouble(values[4].trim());

                double dissolvedOxygen =
                    Double.parseDouble(values[5].trim());

                double bod =
                    Double.parseDouble(values[6].trim());

                if (station.isBlank() ||
                    !Double.isFinite(latitude) ||
                    !Double.isFinite(longitude) ||
                    !Double.isFinite(ph) ||
                    !Double.isFinite(dissolvedOxygen) ||
                    !Double.isFinite(bod) ||
                    latitude < -90 ||
                    latitude > 90 ||
                    longitude < -180 ||
                    longitude > 180 ||
                    ph < 0 ||
                    ph > 14 ||
                    dissolvedOxygen < 0 ||
                    bod < 0) {

                    throw new IllegalArgumentException(
                        "Invalid measurement at row " +
                        rowNumber
                    );
                }

                Map<String, Object> record =
                    new LinkedHashMap<>();

                record.put("station", station);
                record.put("date", date.toString());
                record.put("latitude", latitude);
                record.put("longitude", longitude);
                record.put("ph", ph);
                record.put("do", dissolvedOxygen);
                record.put("bod", bod);

                parsed.add(record);

                if (parsed.size() > 10000) {
                    throw new IllegalArgumentException(
                        "Maximum 10000 records allowed"
                    );
                }
            }

            if (parsed.isEmpty()) {
                throw new IllegalArgumentException(
                    "No monitoring records found"
                );
            }

            // Publish the complete validated dataset.
            // A failed upload leaves the previous data intact.
            records = List.copyOf(parsed);

            return ResponseEntity.ok(Map.of(
                "message", "Dataset uploaded successfully",
                "count", records.size()
            ));

        } catch (Exception exception) {
            return ResponseEntity.badRequest().body(
                Map.of(
                    "error",
                    exception.getMessage() == null
                        ? "Unable to parse CSV"
                        : exception.getMessage()
                )
            );
        }
    }

    @GetMapping("/records")
    public List<Map<String, Object>> getRecords() {
        return records;
    }

    @GetMapping("/summary")
    public Map<String, Object> getSummary() {

        List<Map<String, Object>> snapshot = records;

        if (snapshot.isEmpty()) {
            return Map.of("count", 0);
        }

        double averagePh = snapshot.stream()
            .mapToDouble(r -> (double) r.get("ph"))
            .average()
            .orElse(0);

        double averageDO = snapshot.stream()
            .mapToDouble(r -> (double) r.get("do"))
            .average()
            .orElse(0);

        double averageBOD = snapshot.stream()
            .mapToDouble(r -> (double) r.get("bod"))
            .average()
            .orElse(0);

        return Map.of(
            "count", snapshot.size(),
            "averagePh", averagePh,
            "averageDO", averageDO,
            "averageBOD", averageBOD
        );
    }
}
