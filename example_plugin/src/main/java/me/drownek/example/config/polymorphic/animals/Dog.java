package me.drownek.example.config.polymorphic.animals;

import lombok.Getter;
import lombok.ToString;

@Getter
@ToString(callSuper = true)
public class Dog extends Animal {
    private final boolean goodBoy;

    public Dog(String name, boolean goodBoy) {
        super(name);
        this.goodBoy = goodBoy;
    }

    @Override
    public String speak() {
        return "Woof";
    }
}