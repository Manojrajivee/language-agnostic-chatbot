import django.template.context
from copy import copy

def patch_all():
    try:
        # Define a safe __copy__ for BaseContext that works on Python 3.14+
        def custom_copy(self):
            duplicate = django.template.context.BaseContext()
            duplicate.__class__ = self.__class__
            duplicate.__dict__ = copy(self.__dict__)
            duplicate.dicts = self.dicts[:]
            return duplicate
        
        django.template.context.BaseContext.__copy__ = custom_copy
        print("[LinguaBot Patch] Successfully patched BaseContext.__copy__ for Python 3.14 compatibility.")
    except Exception as e:
        print(f"[LinguaBot Patch] Failed to apply BaseContext patch: {e}")
