package com.siren.repositry;

import com.siren.model.ECase;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ECaseRepository extends MongoRepository<ECase, String> {

    // Corrected method name to match the 'department' field
    List<ECase> findByDepartment(String department, Sort sort);
}