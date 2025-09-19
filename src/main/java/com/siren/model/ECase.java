package com.siren.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Document(collection = "ecases")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ECase {

    @Id
    private String id;       // MongoDB will auto-generate this (ObjectId)

    private String name;
    private String department;
    private String time;
    private String priority;
    private String location;
    private String summary;
    private String status;

    // Optional: constructor without id (for convenience)
    public ECase(String name, String department, String time,
                 String priority, String location, String summary, String status) {
        this.name = name;
        this.department = department;
        this.time = time;
        this.priority = priority;
        this.location = location;
        this.summary = summary;
        this.status = status;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public String getTime() {
        return time;
    }

    public void setTime(String time) {
        this.time = time;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
