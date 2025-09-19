package com.siren.service;
import com.siren.model.ECase;
import com.siren.repositry.ECaseRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class QueryService {

    private final ECaseRepository eCaseRepository;

    public QueryService(ECaseRepository eCaseRepository) {
        this.eCaseRepository = eCaseRepository;
    }

    public List<ECase> getCasesByDepartment(String dept) {
        return eCaseRepository.findByDepartment(dept, Sort.by(Sort.Direction.ASC, "time"));
    }

    public void deleteCase(String id) {
        eCaseRepository.deleteById(id);
    }
}
