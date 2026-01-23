package me.drownek.example.data;

import eu.okaeri.persistence.document.Document;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

@Getter
@Setter
public class User extends Document {

    private BigDecimal balance = new BigDecimal(0);

    public UUID getUuid() {
        return getPath().toUUID();
    }
}
