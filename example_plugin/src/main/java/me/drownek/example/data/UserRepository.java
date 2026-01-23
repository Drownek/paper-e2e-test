package me.drownek.example.data;

import eu.okaeri.persistence.Persistence;
import eu.okaeri.persistence.repository.DocumentRepository;
import eu.okaeri.persistence.repository.annotation.DocumentCollection;
import me.drownek.platform.core.annotation.DependsOn;
import org.bukkit.OfflinePlayer;

import java.util.UUID;

@DependsOn(name = "persistence", type = Persistence.class)
@DocumentCollection(path = "users", keyLength = 36)
public interface UserRepository extends DocumentRepository<UUID, User> {

    default User getByPlayer(OfflinePlayer offlinePlayer) {
        return findOrCreateByPath(offlinePlayer.getUniqueId());
    }
}
