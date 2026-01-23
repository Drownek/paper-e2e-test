package me.drownek.example.config.polymorphic.computer;

/**
 * Server class with specialized behavior
 */
public class Server extends Computer {
    private int cpuCores;
    private boolean isRackMounted;
    
    public Server(String brand, String model, double price, int ramGB, 
                  int cpuCores, boolean isRackMounted) {
        super(brand, model, price, ramGB);
        this.cpuCores = cpuCores;
        this.isRackMounted = isRackMounted;
    }
    
    @Override
    public void boot() {
        System.out.println("Server " + model + " is initializing enterprise services...");
        System.out.println("Cores: " + cpuCores + ", Rack-mounted: " + isRackMounted);
    }
    
    @Override
    public String getType() {
        return "Enterprise Server";
    }
    
    @Override
    public void performTask(String task) {
        System.out.print("🏢 ");
        super.performTask(task);
        System.out.printf("   Utilizing %d cores for maximum throughput%n", cpuCores);
    }
    
    // Server-specific method
    public void handleMultipleClients(int clientCount) {
        System.out.printf("Server handling %d concurrent clients%n", clientCount);
    }
}