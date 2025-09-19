package com.siren.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.siren.model.ECase;
import org.springframework.stereotype.Service;

@Service
public class ECaseBridgeService {

    private final UploadCase uploadCase;
    private final ObjectMapper mapper = new ObjectMapper();

    public ECaseBridgeService(UploadCase uploadCase) {
        this.uploadCase = uploadCase;
    }

    /**
     * Convert Gemini JSON to ECase and save to MongoDB
     */
    public ECase processAndSave(String json) {
        try {
            ECase eCase = mapper.readValue(json, ECase.class);
            return uploadCase.saveCase(eCase);
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse and save ECase: " + e.getMessage(), e);
        }
    }
}
