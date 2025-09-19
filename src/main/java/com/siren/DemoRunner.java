//package com.siren;
//
//import com.siren.service.ECaseBridgeService;
//import org.springframework.boot.CommandLineRunner;
//import org.springframework.stereotype.Component;
//
//@Component
//public class DemoRunner implements CommandLineRunner {
//
//    private final ECaseBridgeService bridgeService;
//
//    public DemoRunner(ECaseBridgeService bridgeService) {
//        this.bridgeService = bridgeService;
//    }
//
//    @Override
//    public void run(String... args) throws Exception {
//        // Default JSON for testing
//        String json = """
//        {
//          "name": "Kushwanth",
//          "department": "IT",
//          "time": "2025-09-15T12:20:00",
//          "priority": "HIGH",
//          "location": "Bangalore",
//          "summary": "Testing default JSON flow",
//          "status": "OPEN"
//        }
//        """;
//
//        // Save into MongoDB Atlas
//        bridgeService.processAndSave(json);
//
//        System.out.println("✅ Default JSON inserted into MongoDB Atlas!");
//    }
//}
