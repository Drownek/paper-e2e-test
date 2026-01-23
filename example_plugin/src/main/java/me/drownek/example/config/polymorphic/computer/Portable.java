package me.drownek.example.config.polymorphic.computer;

/**
 * Interface demonstrating multiple inheritance of behavior
 */
public interface Portable {
    double getWeight();
    int getBatteryLife();
    
    // Default method (Java 8+ feature)
    default boolean isPortable() {
        return getWeight() < 5.0; // Less than 5kg is considered portable
    }
    
    // Static method in interface (Java 8+ feature)
    static String getPortabilityTip() {
        return "Lighter devices are more portable for travel!";
    }
}