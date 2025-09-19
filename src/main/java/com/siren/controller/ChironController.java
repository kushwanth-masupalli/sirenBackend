package com.siren.controller;

import com.siren.service.ChironService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/chiron")
public class ChironController {

    private final ChironService chironService;

    public ChironController(ChironService chironService) {
        this.chironService = chironService;
    }
    @PostMapping("/audio-output")
    @CrossOrigin(origins = "*")
    public ResponseEntity<Map<String, Object>> processAudioText(@RequestBody Map<String, String> request) {
        String text = request.get("text");
        System.out.println(text);
        if (text == null || text.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Text is missing"));
        }
        System.out.println(text);
        Map<String, Object> geminiResponse = chironService.getGeminiOutput(text);
        if (geminiResponse == null) {
            geminiResponse = Map.of("error", "Gemini returned null");
        }

        return ResponseEntity.ok(geminiResponse);
    }

}
