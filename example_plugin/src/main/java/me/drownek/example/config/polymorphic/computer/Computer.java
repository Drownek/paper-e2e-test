package me.drownek.example.config.polymorphic.computer;


import me.drownek.platform.core.configs.polymorphic.Polymorphic;

/**
 * Abstract base class demonstrating inheritance fundamentals
 */
@Polymorphic
public abstract class Computer implements InputProvider {
    protected String brand;
    protected String model;
    protected double price;
    protected int ramGB;
    
    // Constructor
    public Computer(String brand, String model, double price, int ramGB) {
        this.brand = brand;
        this.model = model;
        this.price = price;
        this.ramGB = ramGB;
    }
    
    // Concrete method - inherited by all subclasses
    public void displaySpecs() {
        System.out.printf("Brand: %s, Model: %s, RAM: %dGB, Price: $%.2f%n", 
                         brand, model, ramGB, price);
    }
    
    // Abstract method - must be implemented by subclasses
    public abstract void boot();
    
    // Virtual method - can be overridden
    public String getType() {
        return "Generic Computer";
    }
    
    // Method demonstrating polymorphism
    public void performTask(String task) {
        System.out.println(getType() + " is performing: " + task);
    }
    
    // Getters for encapsulation
    public String getBrand() { return brand; }
    public double getPrice() { return price; }
    public int getRamGB() { return ramGB; }
}