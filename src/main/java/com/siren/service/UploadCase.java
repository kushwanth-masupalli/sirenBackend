package com.siren.service;

import org.springframework.stereotype.Service;
import com.siren.model.ECase;
import com.siren.repositry.ECaseRepository;

@Service
public class UploadCase {

    private final ECaseRepository repository;

    // constructor injection
    public UploadCase(ECaseRepository repository) {
        this.repository = repository;
    }

    // method to upload/save an ECase into MongoDB Atlas
    public ECase saveCase(ECase eCase) {
        return repository.save(eCase);
    }
}
