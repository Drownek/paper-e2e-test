package me.drownek.example.config.polymorphic.computer;

/**
 * Interface for computers that can be upgraded
 */
public interface Upgradeable {
    void upgradeRAM(int additionalGB);
    void upgradeStorage(int additionalGB);
    
    // Sealed interface method (Java 17+ - preparing for pattern matching)
    default void performUpgrade(String component, int amount) {
        switch (component.toLowerCase()) {
            case "ram" -> upgradeRAM(amount);
            case "storage" -> upgradeStorage(amount);
            default -> System.out.println("Unknown component: " + component);
        }
    }
}