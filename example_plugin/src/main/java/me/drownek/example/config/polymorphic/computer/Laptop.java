package me.drownek.example.config.polymorphic.computer;

/**
 * Laptop class demonstrating inheritance and interface implementation
 */
public class Laptop extends Computer implements Portable, Upgradeable {
    private double weightKg;
    private int batteryLife;
    private int storageGB;
    
    public Laptop(String brand, String model, double price, int ramGB, 
                  double weightKg, int batteryLife, int storageGB) {
        super(brand, model, price, ramGB);
        this.weightKg = weightKg;
        this.batteryLife = batteryLife;
        this.storageGB = storageGB;
    }
    
    @Override
    public void boot() {
        System.out.println("Laptop " + model + " is booting with power management...");
    }
    
    @Override
    public String getType() {
        return "Laptop";
    }
    
    // Interface implementations
    @Override
    public double getWeight() { return weightKg; }
    
    @Override
    public int getBatteryLife() { return batteryLife; }
    
    @Override
    public void upgradeRAM(int additionalGB) {
        this.ramGB += additionalGB;
        System.out.printf("Laptop RAM upgraded to %dGB%n", ramGB);
    }
    
    @Override
    public void upgradeStorage(int additionalGB) {
        this.storageGB += additionalGB;
        System.out.printf("Laptop storage upgraded to %dGB%n", storageGB);
    }
    
    // Method overriding with enhanced behavior
    @Override
    public void performTask(String task) {
        System.out.print("📱 ");
        super.performTask(task);
        System.out.println("   Battery remaining: " + batteryLife + " hours");
    }
}