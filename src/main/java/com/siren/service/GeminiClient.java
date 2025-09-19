package com.siren.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

@Component
public class GeminiClient {

    private final WebClient webClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${gemini.api.key}")
    private String apiKey;

    private static final String GEMINI_ENDPOINT =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

    @Autowired
    private ECaseBridgeService eCaseBridgeService; // ✅ Autowired ECaseBridgeService

    public GeminiClient(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.build();
    }

    public Map<String, Object> fetchResponse(String text) {
        try {
            // Build prompt
            String prompt = """
                You are an intelligent JSON extractor for emergency cases.
                Analyze the given emergency report text and extract the following fields:
                - name
                - department (always one of: fire, police, hospital, ambulance, IT,forest,)
                - time
                - priority
                - location
                - summary
                - status

                Rules:
                1. Always return ONLY valid JSON (no markdown, no explanations).
                2. If a field is missing in text, omit it (do not output null).
                3. Department must be one of the allowed values above.
                4. If time is not mentioned, leave it out (backend will auto-fill).

                Example Input:
                "There is a fire in Building B and two cars are burning."

                Example Output:
                {
                  "department": "fire",
                  "priority": "high",
                  "location": "Building B",
                  "summary": "Fire incident with two cars burning"
                }

                Text: "%s"
                """.formatted(text);

            // Prepare request body
            Map<String, Object> requestBody = Map.of(
                    "contents", new Object[]{ Map.of(
                            "parts", new Object[]{ Map.of("text", prompt) }
                    )}
            );

            // Call Gemini API
            String geminiRawResponse = webClient.post()
                    .uri(GEMINI_ENDPOINT)
                    .header("Content-Type", "application/json")
                    .header("x-goog-api-key", apiKey)
                    .body(BodyInserters.fromValue(requestBody))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            System.out.println("=== Gemini Raw Response ===");
            System.out.println(geminiRawResponse);

            if (geminiRawResponse == null) {
                return fallbackResponse(text);
            }

            // Parse root response
            JsonNode root = objectMapper.readTree(geminiRawResponse);
            JsonNode candidates = root.path("candidates");
            if (!candidates.isArray() || candidates.isEmpty()) {
                return fallbackResponse(text);
            }

            JsonNode content = candidates.get(0)
                    .path("content")
                    .path("parts");
            if (!content.isArray() || content.isEmpty()) {
                return fallbackResponse(text);
            }

            // Extract generated text (could be wrapped in ```json ... ```)
            String generatedText = content.get(0).path("text").asText();
            generatedText = generatedText
                    .replaceAll("```json", "")
                    .replaceAll("```", "")
                    .trim();

            // Try parsing as JSON
            JsonNode extracted;
            try {
                extracted = objectMapper.readTree(generatedText);
            } catch (Exception e) {
                System.out.println("⚠️ Failed to parse generated JSON: " + generatedText);
                return fallbackResponse(text);
            }

            // Build final response
            Map<String, Object> finalJson = new HashMap<>();
            String[] fields = {"name", "department", "time", "priority", "location", "summary", "status"};
            for (String f : fields) {
                JsonNode v = extracted.path(f);
                if (!v.isMissingNode() && !v.isNull()) {
                    finalJson.put(f, v.asText());
                }
            }

            // Auto-fill time if missing
            if (!finalJson.containsKey("time")) {
                finalJson.put("time",
                        LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
            }
            String jsonString = objectMapper.writeValueAsString(finalJson);
            eCaseBridgeService.processAndSave(jsonString);
            // ✅ Call ECaseBridgeService to process and save
            eCaseBridgeService.processAndSave(jsonString);

            return finalJson;

        } catch (Exception ex) {
            ex.printStackTrace();
            return Map.of("error", "Failed to call Gemini API or parse response");
        }
    }

    private Map<String, Object> fallbackResponse(String text) {
        Map<String, Object> fallback = new HashMap<>();
        fallback.put("summary", text);
        fallback.put("status", "Unknown");
        fallback.put("time", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));

        // ✅ Also process fallback through ECaseBridgeService
        String jsonString = null;
        try {
            jsonString = objectMapper.writeValueAsString(fallback);
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
        eCaseBridgeService.processAndSave(jsonString);
//        eCaseBridgeService.processAndSave(fallback);

        return fallback;
    }
}
