package me.drownek.example.config.polymorphic.animals;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.ToString;
import me.drownek.platform.core.configs.polymorphic.Polymorphic;

@Polymorphic
@AllArgsConstructor
@Getter
@ToString
public abstract class Animal {
    private final String name;

    public abstract String speak();
}