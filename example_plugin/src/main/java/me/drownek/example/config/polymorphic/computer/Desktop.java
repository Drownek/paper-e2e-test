package me.drownek.example.config.polymorphic.computer;

/**
 * Desktop class demonstrating inheritance without portability
 */
public class Desktop extends Computer implements Upgradeable {
    private int storageGB;
    private boolean hasRGBLighting;
    
    public Desktop(String brand, String model, double price, int ramGB, 
                   int storageGB, boolean hasRGBLighting) {
        super(brand, model, price, ramGB);
        this.storageGB = storageGB;
        this.hasRGBLighting = hasRGBLighting;
    }
    
    @Override
    public void boot() {
        System.out.println("Desktop " + model + " is booting with full power...");
        if (hasRGBLighting) {
            System.out.println("RGB lighting activated! 🌈");
        }
    }
    
    @Override
    public String getType() {
        return "Desktop PC";
    }
    
    @Override
    public void upgradeRAM(int additionalGB) {
        this.ramGB += additionalGB;
        System.out.printf("Desktop RAM upgraded to %dGB (easy upgrade!)%n", ramGB);
    }
    
    @Override
    public void upgradeStorage(int additionalGB) {
        this.storageGB += additionalGB;
        System.out.printf("Desktop storage upgraded to %dGB (multiple drives supported!)%n", storageGB);
    }
    
    @Override
    public void performTask(String task) {
        System.out.print("🖥️  ");
        super.performTask(task);
        System.out.println("   High performance mode enabled!");
    }
}