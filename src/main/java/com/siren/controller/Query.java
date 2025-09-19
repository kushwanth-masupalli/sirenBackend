package com.siren.controller;

import com.siren.model.ECase;
import com.siren.service.QueryService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/siren/db")
@CrossOrigin("*")
public class Query {

    private final QueryService queryService;

    public Query(QueryService queryService) {
        this.queryService = queryService;
    }

    @GetMapping("/{dept}")
    @CrossOrigin(origins = "*")
    public List<ECase> getCasesByDepartment(@PathVariable("dept") String dept) {
        return queryService.getCasesByDepartment(dept);
    }

    @DeleteMapping("/{id}")
    @CrossOrigin(origins = "*")
    public void deleteCase(@PathVariable("id") String id) {
        queryService.deleteCase(id);
    }
}
