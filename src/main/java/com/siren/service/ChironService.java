package com.siren.service;

import com.siren.service.GeminiClient;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class ChironService {

    private final GeminiClient geminiClient;

    public ChironService(GeminiClient geminiClient) {
        this.geminiClient = geminiClient;
    }

    public Map<String, Object> getGeminiOutput(String text) {
        // Send text to Gemini client and get JSON response
        return geminiClient.fetchResponse(text);
    }
}
